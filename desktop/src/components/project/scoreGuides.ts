export type ScoreFactor = 'severity' | 'occurrence' | 'detection'

export type ScoreRow = { value: number; level: string; desc: string }

export const SCORING_GUIDES: Record<ScoreFactor, { title: string; rows: ScoreRow[] }> = {
  severity: {
    title: '严重度 S — 评估影响（AIAG-VDA）',
    rows: [
      { value: 10, level: '安全 / 法规', desc: '可能造成安全事故或违反法规（无警告）' },
      { value: 9, level: '安全 / 法规', desc: '可能造成安全事故或违反法规（有警告）' },
      { value: 8, level: '主要功能丧失', desc: '产品无法使用（客户 100% 抱怨）' },
      { value: 7, level: '主要功能降级', desc: '产品可用但性能显著下降' },
      { value: 6, level: '次要功能丧失', desc: '舒适/便利功能失效，不影响基本功能' },
      { value: 5, level: '次要功能降级', desc: '功能轻微下降，可接受但费力' },
      { value: 4, level: '外观/噪声', desc: '多数客户可感知的瑕疵' },
      { value: 3, level: '轻微外观', desc: '部分客户可感知的瑕疵' },
      { value: 2, level: '几乎无影响', desc: '极少客户感知到' },
      { value: 1, level: '无影响', desc: '无可见影响' },
    ],
  },
  occurrence: {
    title: '频度 O — 失效起因发生可能性',
    rows: [
      { value: 10, level: '极高', desc: '≥ 100‰（几乎不可避免）' },
      { value: 9, level: '极高', desc: '50‰（1/20 批次）' },
      { value: 8, level: '高', desc: '20‰' },
      { value: 7, level: '高', desc: '10‰' },
      { value: 6, level: '中等', desc: '2‰' },
      { value: 5, level: '中等', desc: '0.5‰' },
      { value: 4, level: '中等', desc: '0.1‰' },
      { value: 3, level: '低', desc: '0.01‰' },
      { value: 2, level: '低', desc: '≤ 0.001‰' },
      { value: 1, level: '极低', desc: '几乎不可能' },
    ],
  },
  detection: {
    title: '探测度 D — 现有控制发现失效的能力',
    rows: [
      { value: 10, level: '几乎无法探测', desc: '无控制或现有控制无法探测' },
      { value: 9, level: '极低', desc: '仅人工目视间接检查' },
      { value: 8, level: '低', desc: '人工检查（无法发现根本原因）' },
      { value: 7, level: '低', desc: '人工检查（可发现原因）' },
      { value: 6, level: '中等', desc: '抽样统计控制（SPC）' },
      { value: 5, level: '中等', desc: '过程控制 + 人工抽检' },
      { value: 4, level: '中等偏高', desc: '自动检测异常并反馈' },
      { value: 3, level: '高', desc: '100% 自动测量，可防错' },
      { value: 2, level: '高', desc: '自动防错（Poka-Yoke）且可验证' },
      { value: 1, level: '极高', desc: '防错设计，失效不可能流入下道' },
    ],
  },
}
