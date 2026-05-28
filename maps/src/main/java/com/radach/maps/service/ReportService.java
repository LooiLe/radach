package com.radach.maps.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Report;
import com.radach.maps.model.ReportReason;
import com.radach.maps.model.ReportStatus;
import com.radach.maps.model.User;
import com.radach.maps.repository.ReportRepository;

@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final SpotService spotService;
    private final EventService eventService;
    private final TrailPathService trailPathService;
    private final ReviewService reviewService;

    public ReportService(ReportRepository reportRepository, SpotService spotService,
                         EventService eventService, TrailPathService trailPathService,
                         ReviewService reviewService) {
        this.reportRepository = reportRepository;
        this.spotService = spotService;
        this.eventService = eventService;
        this.trailPathService = trailPathService;
        this.reviewService = reviewService;
    }

    @Transactional
    public Report submitReport(User reporter, String contentType, Long contentId, ReportReason reason, String details) {
        Report report = new Report();
        report.setReporter(reporter);
        report.setContentType(contentType.toUpperCase());
        report.setContentId(contentId);
        report.setReason(reason);
        report.setDetails(details != null ? details.trim() : null);
        report.setStatus(ReportStatus.PENDING);
        return reportRepository.save(report);
    }

    public List<Report> getPendingReports() {
        return reportRepository.findByStatusOrderByCreatedAtDesc(ReportStatus.PENDING);
    }

    @Transactional
    public Report updateReportStatus(Long id, ReportStatus status) {
        Report report = reportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found"));

        if (status == ReportStatus.RESOLVED) {
            // Delete the reported content immediately
            deleteContent(report.getContentType(), report.getContentId());

            // Auto-resolve any other pending reports pointing to the exact same content
            List<Report> relatedReports = reportRepository.findByContentTypeAndContentId(
                    report.getContentType(), report.getContentId());
            for (Report r : relatedReports) {
                if (r.getStatus() == ReportStatus.PENDING) {
                    r.setStatus(ReportStatus.RESOLVED);
                    reportRepository.save(r);
                }
            }
        }

        report.setStatus(status);
        return reportRepository.save(report);
    }

    private void deleteContent(String contentType, Long contentId) {
        try {
            switch (contentType.toUpperCase()) {
                case "SPOT":
                    spotService.deleteSpot(contentId);
                    break;
                case "EVENT":
                    eventService.deleteEvent(contentId);
                    break;
                case "TRAIL_PATH":
                    trailPathService.deletePath(contentId, null, true);
                    break;
                case "REVIEW":
                    reviewService.deleteReviewByAdmin(contentId);
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported content type for reporting: " + contentType);
            }
        } catch (ResourceNotFoundException e) {
            // Offending content was already deleted, ignore and proceed
        }
    }
}
