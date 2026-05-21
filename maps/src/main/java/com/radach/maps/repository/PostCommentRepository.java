package com.radach.maps.repository;

import com.radach.maps.model.PostComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface PostCommentRepository extends JpaRepository<PostComment, Long> {
    List<PostComment> findByPostIdOrderByCreatedAtAsc(Long postId);
    List<PostComment> findByPostIdInOrderByCreatedAtAsc(Collection<Long> postIds);
}
