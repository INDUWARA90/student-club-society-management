package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;

import jakarta.persistence.LockModeType;

public interface ClubRepository extends JpaRepository<Club, UUID>, JpaSpecificationExecutor<Club> {

    List<Club> findByStatus(ClubStatus status);

    List<Club> findByCategory(String category);

    List<Club> findByStatusAndNameContainingIgnoreCase(ClubStatus status, String name);

    boolean existsByIdAndStatus(UUID id, ClubStatus status);

    boolean existsByNameIgnoreCase(String name);

    long countByStatusAndArchivedFalse(ClubStatus status);

    /** Row-locks the club so concurrent position changes (e.g. two President hand-offs) are serialised. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Club c WHERE c.id = :id")
    Optional<Club> findByIdForUpdate(@Param("id") UUID id);
}
