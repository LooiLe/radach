package com.radach.maps.service;

import com.radach.maps.dto.FeedPostRequest;
import com.radach.maps.dto.PostCommentRequest;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.FeedPost;
import com.radach.maps.model.PostComment;
import com.radach.maps.model.PostLike;
import com.radach.maps.repository.FeedPostRepository;
import com.radach.maps.repository.PostCommentRepository;
import com.radach.maps.repository.PostLikeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class FeedPostService {

    private final FeedPostRepository feedPostRepository;
    private final PostLikeRepository postLikeRepository;
    private final PostCommentRepository postCommentRepository;

    public FeedPostService(FeedPostRepository feedPostRepository, PostLikeRepository postLikeRepository, PostCommentRepository postCommentRepository) {
        this.feedPostRepository = feedPostRepository;
        this.postLikeRepository = postLikeRepository;
        this.postCommentRepository = postCommentRepository;
    }

    @Transactional
    public FeedPost createPost(Long authorId, FeedPostRequest request) {
        FeedPost post = new FeedPost();
        post.setAuthorId(authorId);
        post.setContent(request.content());
        post.setMediaUrls(request.mediaUrls());
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
        feedPostRepository.findById(postId)
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
            return true;
        }
    }

    @Transactional
    public PostComment addComment(Long postId, Long authorId, PostCommentRequest request) {
        feedPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found"));

        PostComment comment = new PostComment();
        comment.setPostId(postId);
        comment.setAuthorId(authorId);
        comment.setContent(request.content());
        return postCommentRepository.save(comment);
    }
}
