import { PEPRXBOT_IMAGE, PEPRXBOT_SHORT_DISCLAIMER } from '../../lib/peprxbotRules';

type AiAssistedBadgeProps = {
  compact?: boolean;
};

export default function AiAssistedBadge({ compact = false }: AiAssistedBadgeProps) {
  return (
    <span className={`ai-assisted-badge${compact ? ' compact' : ''}`} title={PEPRXBOT_SHORT_DISCLAIMER}>
      <img src={PEPRXBOT_IMAGE} alt="" aria-hidden="true" />
      <span>AI Assisted by PEPRXbot</span>
    </span>
  );
}
