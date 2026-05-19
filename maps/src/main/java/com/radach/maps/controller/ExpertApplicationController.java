package com.radach.maps.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.ExpertApplicationRequest;
import com.radach.maps.model.ExpertApplication;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ExpertApplicationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1")
public class ExpertApplicationController {

    private final ExpertApplicationService applicationService;
    private final AuthenticatedUserService authenticatedUserService;
    private final UserRepository userRepository;

    public ExpertApplicationController(
            ExpertApplicationService applicationService,
            AuthenticatedUserService authenticatedUserService,
            UserRepository userRepository
    ) {
        this.applicationService = applicationService;
        this.authenticatedUserService = authenticatedUserService;
        this.userRepository = userRepository;
    }

    /** Authenticated user submits an expert application. */
    @PostMapping("/expert-applications")
    @ResponseStatus(HttpStatus.CREATED)
    public ExpertApplicationResponse apply(
            @Valid @RequestBody ExpertApplicationRequest request,
            Authentication authentication
    ) {
        Long userId = authenticatedUserService.getUserId(authentication);
        ExpertApplication app = applicationService.apply(userId, request);
        return toResponse(app, null);
    }

    /** Authenticated user checks their own application status. */
    @GetMapping("/expert-applications/me")
    public List<ExpertApplicationResponse> myApplications(Authentication authentication) {
        Long userId = authenticatedUserService.getUserId(authentication);
        return applicationService.getMyApplications(userId).stream()
                .map(a -> toResponse(a, null))
                .toList();
    }

    /** Admin lists pending expert applications. */
    @GetMapping("/admin/expert-applications/pending")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public List<ExpertApplicationResponse> pendingApplications() {
        List<ExpertApplication> apps = applicationService.getPendingApplications();
        return apps.stream().map(a -> {
            User user = userRepository.findById(a.getUserId()).orElse(null);
            return toResponse(a, user);
        }).toList();
    }

    /** Admin approves an expert application. */
    @PatchMapping("/admin/expert-applications/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ExpertApplicationResponse approve(@PathVariable Long id, Authentication authentication) {
        Long reviewerId = authenticatedUserService.getUserId(authentication);
        ExpertApplication app = applicationService.approve(id, reviewerId);
        User user = userRepository.findById(app.getUserId()).orElse(null);
        return toResponse(app, user);
    }

    /** Admin rejects an expert application. */
    @PatchMapping("/admin/expert-applications/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ExpertApplicationResponse reject(@PathVariable Long id, Authentication authentication) {
        Long reviewerId = authenticatedUserService.getUserId(authentication);
        ExpertApplication app = applicationService.reject(id, reviewerId);
        return toResponse(app, null);
    }

    /** Admin toggles a user's expert status directly. */
    @PutMapping("/admin/users/{id}/toggle-expert")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public Map<String, Object> toggleExpert(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new com.radach.maps.exception.ResourceNotFoundException("User not found"));
        user.setExpert(!user.isExpert());
        userRepository.save(user);
        return Map.of("id", user.getId(), "name", user.getName(), "isExpert", user.isExpert());
    }

    private ExpertApplicationResponse toResponse(ExpertApplication app, User user) {
        return new ExpertApplicationResponse(
                app.getId(),
                app.getUserId(),
                user != null ? user.getName() : null,
                user != null ? user.getEmail() : null,
                app.getProfessionalTitle(),
                app.getOrganization(),
                app.getYearsExperience(),
                app.getSpecializations(),
                app.getPortfolioUrl(),
                app.getJustification(),
                app.getStatus().name(),
                app.getCreatedAt()
        );
    }

    public record ExpertApplicationResponse(
            Long id,
            Long userId,
            String userName,
            String userEmail,
            String professionalTitle,
            String organization,
            Integer yearsExperience,
            String specializations,
            String portfolioUrl,
            String justification,
            String status,
            java.time.Instant createdAt
    ) {}
}
