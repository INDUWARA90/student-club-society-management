package com.club.backend.controller;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;

/**
 * Optional pagination for list endpoints. Without `size` the full list is returned (existing clients keep working);
 * with it, the database returns just the requested page and the full count goes in `X-Total-Count`.
 */
final class PageSupport {

    static final int MAX_PAGE_SIZE = 200;

    private PageSupport() {
    }

    /** The requested page, or null when the caller didn't ask for paging (no {@code size}). */
    static Pageable pageable(Integer page, Integer size, Sort sort) {
        if (size == null) {
            return null;
        }
        int pageSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        int pageIndex = Math.max(0, page == null ? 0 : page);
        return PageRequest.of(pageIndex, pageSize, sort);
    }

    static <T> ResponseEntity<List<T>> respond(Page<T> page) {
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(page.getTotalElements())).body(page.getContent());
    }

    /** In-memory slicing for small, already-loaded lists. */
    static <T> ResponseEntity<List<T>> respond(List<T> all, Integer page, Integer size) {
        if (size == null) {
            return ResponseEntity.ok().header("X-Total-Count", String.valueOf(all.size())).body(all);
        }
        int pageSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        int pageIndex = Math.max(0, page == null ? 0 : page);
        int from = (int) Math.min((long) pageIndex * pageSize, all.size());
        int to = Math.min(from + pageSize, all.size());
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(all.size())).body(all.subList(from, to));
    }
}
