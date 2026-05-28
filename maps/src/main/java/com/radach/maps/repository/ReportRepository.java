package com.radach.maps.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.Report;
import com.radach.maps.model.ReportStatus;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByStatusOrderByCreatedAtDesc(ReportStatus status);
    List<Report> findByContentTypeAndContentId(String contentType, Long contentId);
}
