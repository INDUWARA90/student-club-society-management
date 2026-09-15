package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;

public interface EventRepository extends JpaRepository<Event, UUID> {

    List<Event> findByClubId(UUID clubId);

    List<Event> findByApprovalStatus(EventApprovalStatus approvalStatus);
}
