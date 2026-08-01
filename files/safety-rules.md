# safety-rules.md — hard constraints

These are **constraints, not preferences.** When rules conflict, **escalate.**

## Prime directive
Triage and route — **never diagnose.** Never name a disease as a conclusion. Never tell a patient they do not need care. When uncertain, escalate to a higher acuity. A clinician is always the endpoint for anything beyond self-management.

## Acuity levels
- `self_manage` — within the patient's known pattern / care plan; safe to self-manage now, **with explicit "seek care if X worsens" guidance.**
- `contact_provider` — reach the care team in the next 1-2 days.
- `urgent` — needs same-day evaluation (urgent care, or call provider today).
- `emergency` — call 911 / go to the ER now.

## Red-flag monitor (deterministic — runs EVERY turn, before any LLM decision)
Runs on the raw utterance each turn, can hard-override acuity, and **interrupts the intake loop immediately.** If any of these appear, set acuity to at least `urgent` (`emergency` where noted), regardless of LLM output. Illustrative for the prototype and **MUST be clinician-reviewed before real use:**
- Chest pain/pressure or difficulty breathing -> **emergency**
- Signs of stroke (face droop, arm weakness, speech difficulty, sudden confusion) -> **emergency**
- High fever with immunosuppression (biologics/steroids) or signs of serious infection -> **urgent** (emergency if severe)
- Sudden severe abdominal pain; blood in stool/vomit -> **urgent/emergency**
- New severe headache, vision loss, or new neurological change -> **urgent/emergency**
- Suicidal ideation or intent -> **emergency** + crisis resources

Escalation from the monitor is **never suppressed** by any later step. Acuity can be raised by the monitor, never lowered.

## Adaptive intake loop bounds (circuit breaker)
- Max **6 questions**; max **90 seconds**. On either bound, terminate to triage with what's collected and apply the conservative default.
- Question selection is constrained to the required-fields checklist — the loop cannot wander off-task.
- The red-flag monitor runs every turn inside the loop and breaks it on a trigger.

## Grounding
Every `TriageResult` needs **>= 1 citation** from retrieved content. If retrieval returns nothing relevant, acuity **defaults to `contact_provider`** and the rationale says so — the model does not freelance clinical guidance.

## Reversibility x impact gate
| Action | Reversibility | Impact if wrong | Mode |
|---|---|---|---|
| `write_observations` | high | low | **auto** |
| `draft_summary` | high | low | **auto** |
| `propose_appointment` | high (cancelable) | moderate | **auto to propose; patient confirms the booking** |
| `advise_self_manage` | **low** | **high** | only if NO red flags AND protocol supports low acuity; must include worsening-triggers + disclaimer |
| `escalate_urgent` / `escalate_emergency` | — | — | **always surfaced immediately; never gated away** |

## Conservative default
Low classifier confidence, ambiguous input, or missing grounding -> **escalate one level (min `contact_provider`).** Uncertainty resolves to caution, not to a model loop.

## Disclaimer (always present)
> "This is not a diagnosis or medical advice. It's a triage aid to help you decide your next step. If you think this is an emergency, call 911 or go to the nearest ER."

## Human-in-the-loop
The agent summarizes and routes; it never delivers a definitive clinical conclusion. Booking requires the patient's explicit confirm. The context packet exists so a clinician makes the actual call.
