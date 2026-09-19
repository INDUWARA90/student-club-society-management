package com.club.backend.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;

import jakarta.persistence.criteria.Predicate;

/** Database-side filters for the public club list. */
final class ClubSpecifications {

    private ClubSpecifications() {
    }

    /** Approved, non-archived clubs, optionally narrowed by category and a name/description text match. */
    static Specification<Club> active(String category, String query) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), ClubStatus.APPROVED));
            predicates.add(cb.isFalse(root.get("archived")));
            if (category != null && !category.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.<String>get("category")), category.trim().toLowerCase(Locale.ROOT)));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + EventSpecifications.escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("name")), pattern, '\\'),
                        cb.like(root.<String>get("description"), pattern, '\\')));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
