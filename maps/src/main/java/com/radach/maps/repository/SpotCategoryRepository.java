package com.radach.maps.repository;

import com.radach.maps.model.SpotCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpotCategoryRepository extends JpaRepository<SpotCategory, Long> {
    Optional<SpotCategory> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
}
