package com.radach.maps.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.radach.maps.model.ProcessedStripeEvent;

public interface ProcessedStripeEventRepository extends JpaRepository<ProcessedStripeEvent, String> {
}
