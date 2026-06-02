package com.radach.maps.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.UserCredits;

public interface UserCreditsRepository extends JpaRepository<UserCredits, Long> {

    Optional<UserCredits> findByUserId(Long userId);
}
