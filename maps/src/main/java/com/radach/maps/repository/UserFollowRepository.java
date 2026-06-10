package com.radach.maps.repository;

import com.radach.maps.model.UserFollow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.Set;

public interface UserFollowRepository extends JpaRepository<UserFollow, Long> {

    Optional<UserFollow> findByFollowerIdAndExpertId(Long followerId, Long expertId);

    boolean existsByFollowerIdAndExpertId(Long followerId, Long expertId);

    long countByExpertId(Long expertId);

    @Query("SELECT uf.expertId FROM UserFollow uf WHERE uf.followerId = :followerId")
    Set<Long> findExpertIdsByFollowerId(@Param("followerId") Long followerId);

    @Query("SELECT uf.followerId FROM UserFollow uf WHERE uf.expertId = :expertId")
    Set<Long> findFollowerIdsByExpertId(@Param("expertId") Long expertId);

    void deleteByFollowerIdAndExpertId(Long followerId, Long expertId);
}