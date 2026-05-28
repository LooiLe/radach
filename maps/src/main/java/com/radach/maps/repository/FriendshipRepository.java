package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.Friendship;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f WHERE (f.requesterId = :userId OR f.addresseeId = :userId) AND f.status = 'ACCEPTED'")
    List<Friendship> findAcceptedFriendshipsByUserId(@Param("userId") Long userId);

    @Query("SELECT f FROM Friendship f WHERE f.addresseeId = :userId AND f.status = 'PENDING'")
    List<Friendship> findPendingRequestsForUser(@Param("userId") Long userId);

    @Query("SELECT f FROM Friendship f WHERE f.requesterId = :userId AND f.status = 'PENDING'")
    List<Friendship> findPendingRequestsByUser(@Param("userId") Long userId);

    @Query("SELECT f FROM Friendship f WHERE (f.requesterId = :user1 AND f.addresseeId = :user2) OR (f.requesterId = :user2 AND f.addresseeId = :user1)")
    Optional<Friendship> findByUsers(@Param("user1") Long user1, @Param("user2") Long user2);

    @Query("SELECT f FROM Friendship f WHERE f.requesterId = :userId OR f.addresseeId = :userId")
    List<Friendship> findAllFriendshipsByUserId(@Param("userId") Long userId);
}
