package com.radach.maps.service;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.repository.SpotRepository;

@Service
public class RankingService {

    private static final Logger log = LoggerFactory.getLogger(RankingService.class);

    private final SpotRepository spotRepository;

    public RankingService(SpotRepository spotRepository) {
        this.spotRepository = spotRepository;
    }

    /**
     * Recompute all rank scores in a single SQL statement.
     * 
     * Reviews are weighted by their actual rating (1–5) via SUM(rating),
     * so a 5-star review contributes 5× more than a 1-star review.
     * 
     * Weighted formula:
     *   - Views in last 7 days:          × 1  (baseline traffic signal)
     *   - Approved reviews (all-time):   SUM(rating) × 3  (5-star → 15 pts, 1-star → 3 pts)
     *   - Recent reviews (7 days):       SUM(rating) × 5  (5-star → 25 pts, 1-star → 5 pts)
     *   - Likes in last 7 days:          × 5  (lightweight engagement)
     *   - Saves in last 7 days:          × 10 (stronger intent signal)
     * 
     * Runs every hour via @Scheduled.
     */
    @Scheduled(cron = "0 0 * * * *") // every hour
    @Transactional
    public void computeRankScores() {
        Instant since = Instant.now().minus(Duration.ofDays(7));
        log.info("Recomputing rank scores (since={})", since);
        spotRepository.updateAllRankScores(since);
        log.info("Rank score recomputation complete");
    }
}