package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Venue;

public interface VenueRepository extends JpaRepository<Venue, UUID> {

    List<Venue> findByActiveTrue();

    boolean existsByNameIgnoreCase(String name);

    Optional<Venue> findByNameIgnoreCase(String name);
}
