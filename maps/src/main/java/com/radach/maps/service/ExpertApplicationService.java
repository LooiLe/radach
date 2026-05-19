package com.radach.maps.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.ExpertApplicationRequest;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.ExpertApplication;
import com.radach.maps.model.ExpertApplication.Status;
import com.radach.maps.model.User;
import com.radach.maps.repository.ExpertApplicationRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class ExpertApplicationService {

    private final ExpertApplicationRepository applicationRepository;
    private final UserRepository userRepository;

    public ExpertApplicationService(ExpertApplicationRepository applicationRepository, UserRepository userRepository) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ExpertApplication apply(Long userId, ExpertApplicationRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.isExpert()) {
            throw new IllegalArgumentException("You are already an expert.");
        }

        if (applicationRepository.existsByUserIdAndStatus(userId, Status.PENDING)) {
            throw new IllegalArgumentException("You already have a pending expert application.");
        }

        ExpertApplication app = new ExpertApplication();
        app.setUserId(userId);
        app.setProfessionalTitle(request.professionalTitle().trim());
        app.setOrganization(request.organization() != null ? request.organization().trim() : null);
        app.setYearsExperience(request.yearsExperience());
        app.setSpecializations(request.specializations() != null ? request.specializations().trim() : null);
        app.setPortfolioUrl(request.portfolioUrl() != null ? request.portfolioUrl().trim() : null);
        app.setJustification(request.justification().trim());

        return applicationRepository.save(app);
    }

    public List<ExpertApplication> getMyApplications(Long userId) {
        return applicationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<ExpertApplication> getPendingApplications() {
        return applicationRepository.findByStatus(Status.PENDING);
    }

    @Transactional
    public ExpertApplication approve(Long applicationId, Long reviewerId) {
        ExpertApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));

        if (app.getStatus() != Status.PENDING) {
            throw new IllegalArgumentException("Application has already been reviewed.");
        }

        // Mark application as approved
        app.setStatus(Status.APPROVED);
        app.setReviewedAt(Instant.now());
        app.setReviewedBy(reviewerId);
        applicationRepository.save(app);

        // Promote user to expert and copy profile fields
        User user = userRepository.findById(app.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setExpert(true);
        user.setProfessionalTitle(app.getProfessionalTitle());
        user.setOrganization(app.getOrganization());
        user.setYearsExperience(app.getYearsExperience());
        user.setSpecializations(app.getSpecializations());
        user.setPortfolioUrl(app.getPortfolioUrl());
        userRepository.save(user);

        return app;
    }

    @Transactional
    public ExpertApplication reject(Long applicationId, Long reviewerId) {
        ExpertApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));

        if (app.getStatus() != Status.PENDING) {
            throw new IllegalArgumentException("Application has already been reviewed.");
        }

        app.setStatus(Status.REJECTED);
        app.setReviewedAt(Instant.now());
        app.setReviewedBy(reviewerId);
        return applicationRepository.save(app);
    }
}
