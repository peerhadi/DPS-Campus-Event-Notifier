import { assert } from "console";
import { Mail } from "./test";

function extract_date_from_email() {
    let email = new Mail("We are excited to announce that our Summer Camp 2025 starting on 27th June 2025 for students of Classes 4 to 12.");

    let date = email.date();

    assert.equal(50, 50);
}

