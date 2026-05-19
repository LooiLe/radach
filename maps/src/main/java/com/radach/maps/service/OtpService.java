package com.radach.maps.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.model.EmailOtp;
import com.radach.maps.repository.EmailOtpRepository;

@Service
public class OtpService {

    private final EmailOtpRepository otpRepository;
    private final EmailService emailService;
    private final int expirationMinutes;
    private final SecureRandom random = new SecureRandom();

    public OtpService(
            EmailOtpRepository otpRepository,
            EmailService emailService,
            @Value("${app.otp.expiration-minutes}") int expirationMinutes
    ) {
        this.otpRepository = otpRepository;
        this.emailService = emailService;
        this.expirationMinutes = expirationMinutes;
    }

    /**
     * Generate a 6-digit OTP, persist it, and send it via email.
     * Any previous unused OTPs for the same email are effectively superseded
     * (only the latest is checked during verification).
     */
    @Transactional
    public void generateAndSend(String email) {
        
        // TODO: restore random OTP + email sending when Resend domain is configured
        // String code = "123456";
        String code = String.format("%06d", random.nextInt(1_000_000));

        EmailOtp otp = new EmailOtp();
        otp.setEmail(email.toLowerCase());
        otp.setCode(code);
        otp.setExpiresAt(Instant.now().plus(Duration.ofMinutes(expirationMinutes)));
        otpRepository.save(otp);

        emailService.sendOtpEmail(email, code);
    }

    /**
     * Verify an OTP code for a given email.
     * 
     * @throws IllegalArgumentException if the code is invalid, expired, or already used
     */
    @Transactional
    public void verify(String email, String code) {
        EmailOtp otp = otpRepository.findTopByEmailAndVerifiedFalseOrderByCreatedAtDesc(email.toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("No verification code found. Please request a new one."));

        if (otp.isVerified()) {
            throw new IllegalArgumentException("This code has already been used.");
        }

        if (Instant.now().isAfter(otp.getExpiresAt())) {
            throw new IllegalArgumentException("Verification code has expired. Please request a new one.");
        }

        if (!otp.getCode().equals(code.trim())) {
            throw new IllegalArgumentException("Invalid verification code.");
        }

        // Mark as verified and clean up all OTPs for this email
        otp.setVerified(true);
        otpRepository.save(otp);
        otpRepository.deleteByEmail(email.toLowerCase());
    }
}
