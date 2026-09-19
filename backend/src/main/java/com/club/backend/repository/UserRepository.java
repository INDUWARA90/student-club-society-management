package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Role;
import com.club.backend.entity.User;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(Role role);

    List<User> findByRole(Role role);

    /** Users who want emails but batched into the daily digest. */
    List<User> findByEmailNotificationsEnabledTrueAndEmailDigestEnabledTrue();

    List<User> findByGraduationYearLessThan(int year);
}
