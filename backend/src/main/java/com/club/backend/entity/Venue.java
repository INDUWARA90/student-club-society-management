package com.club.backend.entity;

import java.util.UUID;

import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "venues")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Venue {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 150)
    private String building;

    /** null = capacity not tracked */
    @Column
    private Integer capacity;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;
}
