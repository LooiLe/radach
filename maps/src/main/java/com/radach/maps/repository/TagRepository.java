package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.Tag;

public interface TagRepository extends JpaRepository<Tag, Long> {

    Optional<Tag> findByName(String name);

    List<Tag> findByNameIn(List<String> names);

    /** Tag cloud: returns [tagName, count] pairs ordered by popularity. */
    @Query(value = """
            SELECT t.name, COUNT(st.spot_id) AS cnt
            FROM tags t
            JOIN spot_tags st ON st.tag_id = t.id
            GROUP BY t.id, t.name
            ORDER BY cnt DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findTopTags(@Param("limit") int limit);

    /** Find all tags for a given spot. */
    @Query(value = """
            SELECT t.* FROM tags t
            JOIN spot_tags st ON st.tag_id = t.id
            WHERE st.spot_id = :spotId
            """, nativeQuery = true)
    List<Tag> findBySpotId(@Param("spotId") Long spotId);

    /** Find all spot IDs that have a given tag. */
    @Query(value = """
            SELECT st.spot_id FROM spot_tags st
            JOIN tags t ON t.id = st.tag_id
            WHERE t.name = :tagName
            """, nativeQuery = true)
    List<Long> findSpotIdsByTagName(@Param("tagName") String tagName);
}
