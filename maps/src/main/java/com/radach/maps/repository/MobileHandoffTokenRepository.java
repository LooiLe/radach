package com.radach.maps.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.MobileHandoffToken;

public interface MobileHandoffTokenRepository extends JpaRepository<MobileHandoffToken, Long> {
    Optional<MobileHandoffToken> findByToken(String token);

    @Modifying
    @Query("DELETE FROM MobileHandoffToken t WHERE t.expiresAt < :now OR t.consumedAt IS NOT NULL")
    void deleteExpiredOrConsumed(@Param("now") Instant now);
}
