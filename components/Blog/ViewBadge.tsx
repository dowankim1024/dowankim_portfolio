import EyeIcon from './EyeIcon'

interface ViewBadgeProps {
  count: number
  className?: string
  iconClassName?: string
}

// 눈 아이콘 + 숫자. 목록 카드와 글 상세에서 공통으로 사용
export default function ViewBadge({
  count,
  className = '',
  iconClassName = 'w-4 h-4',
}: ViewBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={`조회수 ${count.toLocaleString('ko-KR')}`}
      aria-label={`조회수 ${count.toLocaleString('ko-KR')}`}
    >
      <EyeIcon className={iconClassName} />
      <span>{count.toLocaleString('ko-KR')}</span>
    </span>
  )
}
