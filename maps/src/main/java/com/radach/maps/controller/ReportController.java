package com.radach.maps.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.model.Report;
import com.radach.maps.model.ReportReason;
import com.radach.maps.model.ReportStatus;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ReportService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportService reportService;
    private final AuthenticatedUserService authenticatedUserService;
    private final UserRepository userRepository;

    public ReportController(ReportService reportService, AuthenticatedUserService authenticatedUserService,
                            UserRepository userRepository) {
        this.reportService = reportService;
        this.authenticatedUserService = authenticatedUserService;
        this.userRepository = userRepository;
    }

    public record ReportRequest(
        @NotNull String contentType,
        @NotNull Long contentId,
        @NotNull String reason,
        String details
    ) {}

    @PostMapping
    public ResponseEntity<Map<String, Object>> submitReport(
            @Valid @RequestBody ReportRequest request,
            Authentication authentication
    ) {
        Long userId = authenticatedUserService.getUserId(authentication);
        User reporter = userRepository.findById(userId).orElseThrow();

        ReportReason reasonEnum = ReportReason.valueOf(request.reason().toUpperCase());
        Report report = reportService.submitReport(
                reporter,
                request.contentType(),
                request.contentId(),
                reasonEnum,
                request.details()
        );

        Map<String, Object> response = new HashMap<>();
        response.put("id", report.getId());
        response.put("status", report.getStatus());
        response.put("message", "Report submitted successfully");
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/admin")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getPendingReports() {
        List<Report> reports = reportService.getPendingReports();
        List<Map<String, Object>> response = reports.stream().map(report -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", report.getId());
            map.put("reporterName", report.getReporter() != null ? report.getReporter().getName() : "Deleted User");
            map.put("reporterEmail", report.getReporter() != null ? report.getReporter().getEmail() : "");
            map.put("contentType", report.getContentType());
            map.put("contentId", report.getContentId());
            map.put("reason", report.getReason());
            map.put("details", report.getDetails());
            map.put("status", report.getStatus());
            map.put("createdAt", report.getCreatedAt());
            return map;
        }).toList();

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/admin/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> updateStatus(
            @PathVariable Long id,
            @RequestParam ReportStatus status
    ) {
        Report report = reportService.updateReportStatus(id, status);
        Map<String, Object> response = new HashMap<>();
        response.put("id", report.getId());
        response.put("status", report.getStatus());
        response.put("message", "Report status updated to " + status);
        return ResponseEntity.ok(response);
    }
}
