package com.radach.maps.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.model.UserCredits;
import com.radach.maps.repository.UserCreditsRepository;

@Service
public class CreditService {

    private final UserCreditsRepository creditsRepository;

    public CreditService(UserCreditsRepository creditsRepository) {
        this.creditsRepository = creditsRepository;
    }

    public int getBalance(Long userId) {
        return creditsRepository.findByUserId(userId)
                .map(UserCredits::getBalance)
                .orElse(0);
    }

    public boolean hasCredits(Long userId) {
        return getBalance(userId) > 0;
    }

    @Transactional
    public void addCredits(Long userId, int amount) {
        UserCredits credits = creditsRepository.findByUserId(userId).orElseGet(() -> {
            UserCredits uc = new UserCredits();
            uc.setUserId(userId);
            uc.setBalance(0);
            return uc;
        });
        credits.setBalance(credits.getBalance() + amount);
        creditsRepository.save(credits);
    }

    @Transactional
    public void deductCredit(Long userId) {
        UserCredits credits = creditsRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("No credits found"));
        if (credits.getBalance() <= 0) {
            throw new IllegalArgumentException("Insufficient credits");
        }
        credits.setBalance(credits.getBalance() - 1);
        creditsRepository.save(credits);
    }
}
