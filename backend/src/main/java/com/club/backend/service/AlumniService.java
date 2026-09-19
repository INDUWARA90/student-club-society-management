package com.club.backend.service;

import java.time.ZoneOffset;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.club.backend.dto.AlumniResponse;
import com.club.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AlumniService {

    private final UserRepository userRepository;

    /** Alumni = anyone whose graduation year has already passed. */
    public List<AlumniResponse> listAlumni() {
        int currentYear = Instant.now().atZone(ZoneOffset.UTC).getYear();
        return userRepository.findByGraduationYearLessThan(currentYear).stream()
                .map(AlumniResponse::from)
                .sorted(Comparator.comparing(AlumniResponse::graduationYear).reversed()
                        .thenComparing(AlumniResponse::name))
                .toList();
    }
}
