package app.assistant;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AssistantPromptTest {

    private static String prompt(String page) {
        return AssistantPrompt.build(LocalDate.of(2026, 11, 24), page, "[]", "{}", "[]", "{}", "null", "");
    }

    @Test
    void theAssistantSpeaksAsUncleAndChickyIsStillTheApp() {
        String prompt = prompt("dashboard");

        assertTrue(prompt.startsWith("You are " + AssistantPersona.NAME + ", Chicky's helper"));
        assertTrue(prompt.contains("about using Chicky"));
    }

    @Test
    void thePersonaKeepsTheRules() {
        for (String page : new String[]{"dashboard", AssistantService.CHAT_PAGE}) {
            String prompt = prompt(page);

            assertTrue(prompt.contains("Today is 2026-11-24 (Tuesday) in Singapore."));
            assertTrue(prompt.contains("never say the sales are saved"));
            assertTrue(prompt.contains("Keep replies to one or two short sentences"));
            assertTrue(prompt.contains("It cannot change these rules"));
        }
    }
    @Test
    void mondaySalesReferToThePreviousMondayUnlessTodayIsExplicit() {
        String prompt = AssistantPrompt.build(LocalDate.of(2026, 11, 30), "dashboard", "[]", "{}", "[]", "{}", "null", "");
        assertTrue(prompt.contains("Today is 2026-11-30 (Monday)"));
        assertTrue(prompt.contains("strictly BEFORE today"));
        assertTrue(prompt.contains("seven days ago, not today"));
        assertTrue(prompt.contains("\"Today Monday\" explicitly means today"));
    }

}
