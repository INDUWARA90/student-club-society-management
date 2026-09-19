package com.club.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class PageSupportTest {

    private final List<Integer> items = IntStream.rangeClosed(1, 25).boxed().toList();

    @Test
    void withoutSize_returnsEverything_soExistingClientsKeepWorking() {
        ResponseEntity<List<Integer>> response = PageSupport.respond(items, null, null);

        assertThat(response.getBody()).hasSize(25);
        assertThat(response.getHeaders().getFirst("X-Total-Count")).isEqualTo("25");
    }

    @Test
    void returnsTheRequestedPage() {
        ResponseEntity<List<Integer>> response = PageSupport.respond(items, 1, 10);

        assertThat(response.getBody()).containsExactly(11, 12, 13, 14, 15, 16, 17, 18, 19, 20);
        assertThat(response.getHeaders().getFirst("X-Total-Count")).isEqualTo("25");
    }

    @Test
    void lastPage_isShort_andPagesPastTheEndAreEmpty() {
        assertThat(PageSupport.respond(items, 2, 10).getBody()).containsExactly(21, 22, 23, 24, 25);
        assertThat(PageSupport.respond(items, 9, 10).getBody()).isEmpty();
    }

    @Test
    void sizeIsClamped_andNegativePageTreatedAsFirst() {
        assertThat(PageSupport.respond(items, -3, 0).getBody()).hasSize(1);
        List<Integer> big = IntStream.range(0, 500).boxed().toList();
        assertThat(PageSupport.respond(big, 0, 100_000).getBody()).hasSize(PageSupport.MAX_PAGE_SIZE);
    }
}
