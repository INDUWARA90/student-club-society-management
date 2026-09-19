package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.ClubResource;

public interface ClubResourceRepository extends JpaRepository<ClubResource, UUID> {

    List<ClubResource> findByClubIdOrderByCreatedAtDesc(UUID clubId);
}
