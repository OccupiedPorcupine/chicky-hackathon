package app.service;

import app.exception.AccountLinkingRequiredException;
import app.user.AppUser;
import app.user.AppUserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Runs against the real JPA stack: each repository call gets its own persistence context,
// which is what exposed returning Google users being mistaken for someone else.
@SpringBootTest
class AppUserServiceTest {

    // Stubbed so the test does not call data.gov.sg on startup.
    @MockitoBean
    PublicHolidaySyncService publicHolidaySyncService;

    @Autowired
    AppUserService appUserService;

    @Autowired
    AppUserRepository appUserRepository;

    @Autowired
    JdbcTemplate jdbc;

    // Only this class's users (all @app-users.test). Other test classes can leave users behind with rows that
    // reference them (assistant usage, interactions), so deleting every user would fail on those foreign keys.
    @BeforeEach
    void clearUsers() {
        jdbc.update("DELETE FROM app_users WHERE LOWER(email) LIKE '%@app-users.test'");
    }

    private int testUsers() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM app_users WHERE LOWER(email) LIKE '%@app-users.test'", Integer.class);
    }

    @Test
    void returningGoogleUserCanSignInAgain() {
        AppUser first = appUserService.findOrCreateUser(googlePayload("google-sub-1", "Person@App-Users.test", "Person"));

        AppUser second = assertDoesNotThrow(() ->
                appUserService.findOrCreateUser(googlePayload("google-sub-1", "person@app-users.test", "Person Renamed")));

        assertEquals(first.getId(), second.getId());
        assertEquals("Person Renamed", second.getName());
        assertEquals(1, testUsers());
    }

    @Test
    void differentGoogleAccountWithAConfirmedEmailStillNeedsLinking() {
        AppUser local = AppUser.localUser("person@app-users.test", "{pbkdf2}hash", "Person");
        local.markEmailVerified(Instant.now());
        appUserRepository.save(local);

        assertThrows(AccountLinkingRequiredException.class, () ->
                appUserService.findOrCreateUser(googlePayload("google-sub-2", "person@app-users.test", "Person")));
    }

    @Test
    void googleUserTakesOverAnAccountThatNeverConfirmedTheirEmail() {
        AppUser local = appUserRepository.save(AppUser.localUser("person@app-users.test", "{pbkdf2}hash", "Someone else"));

        AppUser claimed = appUserService.findOrCreateUser(googlePayload("google-sub-4", "person@app-users.test", "Person"));

        assertEquals(local.getId(), claimed.getId());
        assertEquals("google-sub-4", claimed.getGoogleId());
        assertFalse(claimed.hasPassword());
        assertTrue(claimed.isEmailVerified());
        assertEquals("Person", claimed.getName());
        assertEquals(1, testUsers());
    }

    @Test
    void googleUserCannotTakeAnEmailOwnedByAnotherAccount() {
        appUserService.findOrCreateUser(googlePayload("google-sub-3", "first@app-users.test", "First"));
        appUserRepository.save(AppUser.localUser("second@app-users.test", "{pbkdf2}hash", "Second"));

        // The Google account's email changed to one that another account already uses.
        assertThrows(AccountLinkingRequiredException.class, () ->
                appUserService.findOrCreateUser(googlePayload("google-sub-3", "second@app-users.test", "First")));
    }

    private static GoogleIdToken.Payload googlePayload(String subject, String email, String name) {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setSubject(subject);
        payload.setEmail(email);
        payload.set("name", name);
        return payload;
    }
}
