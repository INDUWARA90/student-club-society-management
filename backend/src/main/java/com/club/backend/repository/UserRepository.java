package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.club.backend.entity.Role;
import com.club.backend.entity.User;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(Role role);

    long countByRoleAndActiveTrue(Role role);

    /** Admin user search: optional role filter and an optional lower-cased LIKE pattern matched against name or email. */
    @Query("select u from User u where (:role is null or u.role = :role) "
            + "and (:pattern is null or lower(u.name) like :pattern or lower(u.email) like :pattern)")
    Page<User> search(@Param("role") Role role, @Param("pattern") String pattern, Pageable pageable);

    List<User> findByRole(Role role);

    /** Users who want emails but batched into the daily digest. */
    List<User> findByEmailNotificationsEnabledTrueAndEmailDigestEnabledTrue();

    List<User> findByGraduationYearLessThan(int year);
}
