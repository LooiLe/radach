package com.radach.maps.service;

import com.radach.maps.dto.FeedPostRequest;
import com.radach.maps.dto.PostCommentRequest;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.FeedPost;
import com.radach.maps.model.PostComment;
import com.radach.maps.model.PostLike;
import com.radach.maps.model.User;
import com.radach.maps.repository.FeedPostRepository;
import com.radach.maps.repository.PostCommentRepository;
import com.radach.maps.repository.PostLikeRepository;
import com.radach.maps.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class FeedPostService {

    private final FeedPostRepository feedPostRepository;
    private final PostLikeRepository postLikeRepository;
    private final PostCommentRepository postCommentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public FeedPostService(FeedPostRepository feedPostRepository, PostLikeRepository postLikeRepository,
                           PostCommentRepository postCommentRepository, UserRepository userRepository,
                           NotificationService notificationService) {
        this.feedPostRepository = feedPostRepository;
        this.postLikeRepository = postLikeRepository;
        this.postCommentRepository = postCommentRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public FeedPost createPost(Long authorId, FeedPostRequest request) {
        FeedPost post = new FeedPost();
        post.setAuthorId(authorId);
        post.setContent(request.content());
        post.setMediaUrls(request.mediaUrls());
        post.setSpotId(request.spotId());
        post.setEventId(request.eventId());
        post.setJourneyId(request.journeyId());
        return feedPostRepository.save(post);
    }

    @Transactional
    public void deletePost(Long postId, Long userId) {
        FeedPost post = feedPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found"));
        if (!post.getAuthorId().equals(userId)) {
            throw new IllegalArgumentException("Cannot delete someone else's post");
        }
        feedPostRepository.delete(post);
    }

    @Transactional
    public boolean toggleLike(Long postId, Long userId) {
        FeedPost post = feedPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found"));

        Optional<PostLike> existing = postLikeRepository.findByPostIdAndUserId(postId, userId);
        if (existing.isPresent()) {
            postLikeRepository.delete(existing.get());
            return false;
        } else {
            PostLike like = new PostLike();
            like.setPostId(postId);
            like.setUserId(userId);
            postLikeRepository.save(like);

            // Notify post author if different user
            if (!post.getAuthorId().equals(userId)) {
                User liker = userRepository.findById(userId).orElse(null);
                String likerName = liker != null ? liker.getName() : "Someone";
                notificationService.createNotification(
                        post.getAuthorId(),
                        "POST_LIKE",
                        likerName + " liked your post",
                        postId,
                        "POST"
                );
            }
            return true;
        }
    }

    @Transactional
    public PostComment addComment(Long postId, Long authorId, PostCommentRequest request) {
        FeedPost post = feedPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found"));

        PostComment comment = new PostComment();
        comment.setPostId(postId);
        comment.setAuthorId(authorId);
        comment.setContent(request.content());
        PostComment saved = postCommentRepository.save(comment);

        // Notify post author if different user
        if (!post.getAuthorId().equals(authorId)) {
            User commenter = userRepository.findById(authorId).orElse(null);
            String commenterName = commenter != null ? commenter.getName() : "Someone";
            notificationService.createNotification(
                    post.getAuthorId(),
                    "POST_COMMENT",
                    commenterName + " commented on your post: " + (request.content().length() > 50 ? request.content().substring(0, 50) + "..." : request.content()),
                    postId,
                    "POST"
            );
        }
        return saved;
    }
}
