package com.club.backend.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import com.club.backend.config.ApiException;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.service.MembershipService;
import com.club.backend.service.RsvpService;

/**
 * The races the unit tests can only describe: real threads against the real database, real row locks and the real
 * unique constraint. If a lock or an isolation level regresses, these fail.
 */
class ConcurrencyIntegrationTest extends IntegrationTestBase {

    @Autowired
    private RsvpService rsvpService;
    @Autowired
    private MembershipService membershipService;
    @Autowired
    private RsvpRepository rsvpRepository;

    /** Runs the tasks at the same instant on separate threads and returns each outcome (result or exception). */
    private <T> List<Object> race(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CyclicBarrier startLine = new CyclicBarrier(tasks.size());
        try {
            List<Future<Object>> futures = new ArrayList<>();
            for (Callable<T> task : tasks) {
                futures.add(pool.submit(() -> {
                    startLine.await(10, TimeUnit.SECONDS);
                    try {
                        return task.call();
                    } catch (Throwable t) {
                        return t;
                    }
                }));
            }
            List<Object> outcomes = new ArrayList<>();
            for (Future<Object> future : futures) {
                try {
                    outcomes.add(future.get(60, TimeUnit.SECONDS));
                } catch (ExecutionException e) {
                    outcomes.add(e.getCause());
                }
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    private long count(Event event, RsvpStatus status) {
        return rsvpRepository.countByEventIdAndStatus(event.getId(), status);
    }

    private List<Integer> waitlistOrders(Event event) {
        return rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(event.getId(), RsvpStatus.WAITLISTED)
                .stream().map(Rsvp::getWaitlistOrder).toList();
    }

    // ---------------------------------------------------------------- RSVPs

    @Test
    void simultaneousRsvpsNeverOverbookAnEvent() throws Exception {
        User owner = student("Owner");
        Club club = approvedClub(owner, "Chess");
        Event event = event(club, "Tournament", 3);
        List<User> people = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            people.add(student("Person " + i));
        }

        List<Callable<Object>> tasks = new ArrayList<>();
        for (User person : people) {
            tasks.add(() -> rsvpService.rsvp(event.getId(), principal(person)));
        }
        List<Object> outcomes = race(tasks);

        assertThat(outcomes).noneMatch(o -> o instanceof Throwable);
        assertThat(count(event, RsvpStatus.GOING)).isEqualTo(3);
        assertThat(count(event, RsvpStatus.WAITLISTED)).isEqualTo(5);
        // Waitlist positions are unique and contiguous — no duplicates from the old "size + 1" scheme.
        assertThat(waitlistOrders(event)).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void simultaneousCancellationsPromoteExactlyEnoughPeopleAndCloseTheQueue() throws Exception {
        User owner = student("Owner");
        Club club = approvedClub(owner, "Chess");
        Event event = event(club, "Tournament", 3);
        List<User> going = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            User person = student("Going " + i);
            going.add(person);
            rsvpService.rsvp(event.getId(), principal(person));
        }
        for (int i = 0; i < 5; i++) {
            rsvpService.rsvp(event.getId(), principal(student("Waiting " + i)));
        }
        assertThat(waitlistOrders(event)).containsExactly(1, 2, 3, 4, 5);

        List<Callable<Object>> tasks = new ArrayList<>();
        for (User person : going) {
            tasks.add(() -> {
                rsvpService.cancelRsvp(event.getId(), principal(person));
                return "cancelled";
            });
        }
        List<Object> outcomes = race(tasks);

        assertThat(outcomes).noneMatch(o -> o instanceof Throwable);
        assertThat(count(event, RsvpStatus.GOING)).isEqualTo(3);       // three waiting people took the seats
        assertThat(count(event, RsvpStatus.CANCELLED)).isEqualTo(3);
        assertThat(waitlistOrders(event)).containsExactly(1, 2);       // the other two moved up
    }

    // ---------------------------------------------------------------- President integrity

    @Test
    void theDatabaseItselfRefusesASecondPresident() {
        User first = student("First");
        User second = student("Second");
        Club club = approvedClub(first, "Chess");
        member(first, club, MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> member(second, club, MembershipPosition.PRESIDENT))
                .isInstanceOf(DataIntegrityViolationException.class);
        // Any number of other officers is fine, and other clubs have their own President.
        member(second, club, MembershipPosition.TREASURER);
        member(student("Third"), club, MembershipPosition.TREASURER);
        member(second, approvedClub(second, "Poker"), MembershipPosition.PRESIDENT);
    }

    @Test
    void concurrentHandOffsLeaveExactlyOnePresidentAndNeverFailWithAServerError() throws Exception {
        User alice = student("Alice");
        User bob = student("Bob");
        User carol = student("Carol");
        Club club = approvedClub(alice, "Chess");
        member(alice, club, MembershipPosition.PRESIDENT);
        Membership bobMembership = member(bob, club, MembershipPosition.MEMBER);
        Membership carolMembership = member(carol, club, MembershipPosition.MEMBER);

        // Alice hands the role to Bob and to Carol at the same moment.
        List<Object> outcomes = race(List.of(
                () -> membershipService.assignPosition(bobMembership.getId(), MembershipPosition.PRESIDENT, principal(alice)),
                () -> membershipService.assignPosition(carolMembership.getId(), MembershipPosition.PRESIDENT, principal(alice))));

        long succeeded = outcomes.stream().filter(o -> !(o instanceof Throwable)).count();
        assertThat(succeeded).isEqualTo(1);
        // The loser is told it isn't allowed any more (it's no longer President) — a clean ApiException, not a crash.
        assertThat(outcomes).filteredOn(o -> o instanceof Throwable).allMatch(o -> o instanceof ApiException);
        List<Membership> presidents = membershipRepository.findByClubId(club.getId()).stream()
                .filter(m -> m.getPosition() == MembershipPosition.PRESIDENT).toList();
        assertThat(presidents).hasSize(1);
        assertThat(presidents.get(0).getUser().getId()).isIn(bob.getId(), carol.getId());
    }

    @Test
    void twoOfficersClaimingAGraduatedPresidentsSeatAtOnceProduceOneWinner() throws Exception {
        User oldPresident = student("Old President");
        oldPresident.setGraduationYear(java.time.Year.now().getValue() - 1);
        userRepository.save(oldPresident);
        User vp = student("Vee");
        User secretary = student("Sec");
        Club club = approvedClub(oldPresident, "Chess");
        member(oldPresident, club, MembershipPosition.PRESIDENT);
        member(vp, club, MembershipPosition.VP);
        member(secretary, club, MembershipPosition.SECRETARY);

        List<Object> outcomes = race(List.of(
                () -> membershipService.claimPresidency(club.getId(), principal(vp)),
                () -> membershipService.claimPresidency(club.getId(), principal(secretary))));

        // The VP outranks the Secretary in a club that has a VP, so only the VP may ever win.
        assertThat(outcomes.stream().filter(o -> !(o instanceof Throwable)).count()).isEqualTo(1);
        List<Membership> presidents = membershipRepository.findByClubId(club.getId()).stream()
                .filter(m -> m.getPosition() == MembershipPosition.PRESIDENT).toList();
        assertThat(presidents).hasSize(1);
        assertThat(presidents.get(0).getUser().getId()).isEqualTo(vp.getId());
        assertThat(membershipRepository.findByUserIdAndClubId(oldPresident.getId(), club.getId()).orElseThrow().getPosition())
                .isEqualTo(MembershipPosition.MEMBER);
        assertThat(membershipRepository.findByUserIdAndClubId(vp.getId(), club.getId()).orElseThrow().getStatus())
                .isEqualTo(MembershipStatus.APPROVED);
    }
}
