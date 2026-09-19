package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.ClubExpense;

public interface ClubExpenseRepository extends JpaRepository<ClubExpense, UUID> {

    List<ClubExpense> findByClubIdOrderByExpenseDateDesc(UUID clubId);
}
