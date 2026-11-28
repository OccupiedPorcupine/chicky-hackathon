package app.assistant;

import app.dto.AssistantMessageResponse;
import app.dto.ProposalEntryInput;
import app.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/** Persists realtime proposals without a second model call; all sales writes still use AssistantService. */
@Service
public class RealtimeProposalStore {
    private final ProposalValidator validator;
    private final AssistantInteractionRepository interactions;
    private final AppUserRepository users;
    private final AssistantService assistant;
    private final JsonMapper mapper;
    private final Clock clock;

    public RealtimeProposalStore(ProposalValidator validator, AssistantInteractionRepository interactions,
                                 AppUserRepository users, AssistantService assistant, JsonMapper mapper, Clock clock) {
        this.validator = validator;
        this.interactions = interactions;
        this.users = users;
        this.assistant = assistant;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional
    public AssistantMessageResponse.Proposal replace(Long owner, String sessionId, String text,
                                                     String model, List<ProposalEntryInput> inputs, Long previousId) {
        var checked = validator.validateProposal(owner, inputs, LocalDate.now(clock));
        if (!checked.isValid()) throw new AssistantException(HttpStatus.BAD_REQUEST,
                "INVALID_PROPOSAL", String.join(" ", checked.problems()));
        // The dedicated realtime tools only propose existing dishes, which keeps a spoken
        // correction bound to a stable dish ID and prevents a short-name new-dish bypass.
        if (checked.entries().stream().anyMatch(ProposedEntry::isNewDish)) {
            throw new AssistantException(HttpStatus.BAD_REQUEST, "INVALID_PROPOSAL",
                    "Add the dish on the Dishes page before recording it in live voice.");
        }
        if (previousId != null) assistant.cancelProposal(owner, previousId);
        var record = interactions.save(new AssistantInteraction(users.getReferenceById(owner), sessionId,
                "close-shift", "voice", text, MessageLanguages.label(text),
                "Review the sales and explicitly confirm to save.", model, 0, "SALES",
                mapper.writeValueAsString(checked.entries()), null, clock.instant()));
        return new AssistantMessageResponse.Proposal(record.getId(), "SALES", checked.entries(),
                List.of(), null, null, record.getCreatedAt().plus(AssistantService.PROPOSAL_LIFETIME));
    }
}
