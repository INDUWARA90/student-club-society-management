package com.club.backend.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.jpa.domain.Specification;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;

/** Database-side filters for the public event list, so filtering and paging never load the whole table. */
final class EventSpecifications {

    private EventSpecifications() {
    }

    /** Published events of active (approved, not archived) clubs, optionally narrowed by club, text, category and date window. */
    static Specification<Event> published(UUID clubId, String query, String category, Instant from, Instant to) {
        return (root, criteriaQuery, cb) -> {
            Join<Event, Club> club = root.join("club");
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(root.get("approvalStatus").in(EventApprovalStatus.NOT_REQUIRED, EventApprovalStatus.APPROVED));
            predicates.add(cb.equal(club.get("status"), ClubStatus.APPROVED));
            predicates.add(cb.isFalse(club.get("archived")));
            if (clubId != null) {
                predicates.add(cb.equal(club.get("id"), clubId));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("title")), pattern, '\\'),
                        cb.like(root.<String>get("description"), pattern, '\\')));
            }
            if (category != null && !category.isBlank()) {
                predicates.add(cb.equal(cb.lower(club.<String>get("category")), category.trim().toLowerCase(Locale.ROOT)));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("eventDate"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThan(root.<Instant>get("eventDate"), to));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
