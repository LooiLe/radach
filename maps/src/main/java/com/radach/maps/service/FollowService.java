package com.radach.maps.service;

import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.User;
import com.radach.maps.model.UserFollow;
import com.radach.maps.repository.UserFollowRepository;
import com.radach.maps.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
public class FollowService {

    private final UserFollowRepository followRepo;
    private final UserRepository userRepo;

    public FollowService(UserFollowRepository followRepo, UserRepository userRepo) {
        this.followRepo = followRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public void followExpert(Long followerId, Long expertId) {
        if (followerId.equals(expertId)) {
            throw new IllegalArgumentException("Cannot follow yourself");
        }
        User expert = userRepo.findById(expertId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!expert.isExpert()) {
            throw new IllegalArgumentException("User is not an expert");
        }
        if (followRepo.existsByFollowerIdAndExpertId(followerId, expertId)) {
            return; // already following
        }
        UserFollow follow = new UserFollow();
        follow.setFollowerId(followerId);
        follow.setExpertId(expertId);
        followRepo.save(follow);
    }

    @Transactional
    public void unfollowExpert(Long followerId, Long expertId) {
        followRepo.deleteByFollowerIdAndExpertId(followerId, expertId);
    }

    public boolean isFollowing(Long followerId, Long expertId) {
        return followRepo.existsByFollowerIdAndExpertId(followerId, expertId);
    }

    public long getFollowerCount(Long expertId) {
        return followRepo.countByExpertId(expertId);
    }

    public Set<Long> getFollowedExpertIds(Long followerId) {
        return followRepo.findExpertIdsByFollowerId(followerId);
    }

    public Set<Long> getFollowerIds(Long expertId) {
        return followRepo.findFollowerIdsByExpertId(expertId);
    }
}