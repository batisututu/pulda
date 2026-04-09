import type { SharedItem } from './SharedItem';

/**
 * 소셜 피드 아이템: SharedItem에 작성자 닉네임/아바타를 JOIN한 읽기 전용 프로젝션.
 * findFeed() 쿼리에서 users 테이블을 JOIN하여 반환한다.
 * 원본 SharedItem 엔티티는 작성자 정보를 포함하지 않으므로 별도 타입으로 분리.
 */
export interface FeedItem extends SharedItem {
  authorNickname: string;
  authorAvatarUrl: string | null;
}
