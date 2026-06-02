package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.SubscriptionStatus;
import com.radach.maps.model.UserSubscription;

public interface UserSubscriptionRepository extends JpaRepository<UserSubscription, Long> {

    Optional<UserSubscription> findByUserIdAndStatus(Long userId, SubscriptionStatus status);

    List<UserSubscription> findAllByUserIdAndStatus(Long userId, SubscriptionStatus status);

    Optional<UserSubscription> findByStripeSubscriptionId(String stripeSubscriptionId);

    Optional<UserSubscription> findFirstByUserIdAndStatusOrderByCreatedAtDesc(Long userId, SubscriptionStatus status);

    Optional<UserSubscription> findFirstByUserIdOrderByCreatedAtDesc(Long userId);
}
