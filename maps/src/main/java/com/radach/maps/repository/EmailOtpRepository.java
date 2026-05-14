package com.radach.maps.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.EmailOtp;

public interface EmailOtpRepository extends JpaRepository<EmailOtp, Long> {

    /** Get the latest unused OTP for an email address. */
    Optional<EmailOtp> findTopByEmailAndVerifiedFalseOrderByCreatedAtDesc(String email);

    /** Clean up all OTPs for an email after successful verification. */
    void deleteByEmail(String email);
}
