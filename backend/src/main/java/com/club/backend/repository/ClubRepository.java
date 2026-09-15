package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;

public interface ClubRepository extends JpaRepository<Club, UUID> {

    List<Club> findByStatus(ClubStatus status);

    List<Club> findByCategory(String category);
}
