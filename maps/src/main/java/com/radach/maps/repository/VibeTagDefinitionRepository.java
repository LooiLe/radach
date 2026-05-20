package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.VibeTagDefinition;

public interface VibeTagDefinitionRepository extends JpaRepository<VibeTagDefinition, Long> {
    Optional<VibeTagDefinition> findByName(String name);
    List<VibeTagDefinition> findByCategory(String category);
}