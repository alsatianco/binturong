use binturong_lib::tools::run_converter_tool;
use serde_json::{json, Value};

fn analyze(input: &str) -> Value {
    let output = run_converter_tool("word-frequency-counter".into(), input.into())
        .expect("word frequency output");
    serde_json::from_str(&output).expect("JSON output")
}

#[test]
fn word_frequency_stats_preserve_whitespace_and_unicode() {
    let text = "  Café 🙂!\r\n \t\r\n你好。  ";
    let output = analyze(text);
    let stats = &output["stats"];
    assert_eq!(stats["words"], 2);
    assert_eq!(stats["characters"], text.chars().count());
    assert_eq!(stats["spaces"], 6);
    assert_eq!(stats["sentences"], 2);
    assert_eq!(stats["paragraphs"], 2);
    assert_eq!(stats["readingLevel"]["grade"], Value::Null);
    assert_eq!(stats["readingTime"], json!({ "wordsPerMinute": 200, "seconds": 1 }));
    assert_eq!(stats["speakingTime"], json!({ "wordsPerMinute": 130, "seconds": 1 }));
}

#[test]
fn word_frequency_stats_cover_empty_and_punctuation_only_text() {
    for input in ["", " \n\t ", "...!?🙂", r#"{"text":""}"#] {
        let output = analyze(input);
        let stats = &output["stats"];
        assert_eq!(stats["words"], 0);
        assert_eq!(stats["sentences"], 0);
        assert_eq!(stats["readingLevel"]["grade"], Value::Null);
        assert_eq!(stats["readingTime"]["seconds"], 0);
        assert_eq!(stats["speakingTime"]["seconds"], 0);
        assert_eq!(output["items"], json!([]));
    }
    assert_eq!(analyze("")["stats"]["paragraphs"], 0);
    assert_eq!(analyze(" \n\t ")["stats"]["characters"], 4);
}

#[test]
fn word_frequency_stats_use_full_text_independently_of_filters_and_limits() {
    let output = analyze(r#"{"text":"a cat elephant elephant dog","minWordLength":4,"limit":1}"#);
    assert_eq!(output["stats"]["words"], 5);
    assert_eq!(output["totalWords"], 2);
    assert_eq!(output["uniqueWords"], 1);
    assert_eq!(output["items"], json!([{ "word": "elephant", "count": 2 }]));

    let limited = analyze(r#"{"text":"cat dog cat elephant","limit":1}"#);
    assert_eq!(limited["stats"]["words"], 4);
    assert_eq!(limited["totalWords"], 4);
    assert_eq!(limited["uniqueWords"], 3);
    assert_eq!(limited["items"], json!([{ "word": "cat", "count": 2 }]));
}

#[test]
fn word_frequency_stats_reading_level_matches_known_ari_score() {
    let output = analyze("The quick brown fox jumps over the lazy dog. Another sentence follows.");
    assert_eq!(output["stats"]["words"], 12);
    assert_eq!(output["stats"]["sentences"], 2);
    assert_eq!(output["stats"]["readingLevel"], json!({ "method": "ARI", "grade": 3.9 }));
    assert_eq!(analyze("A cat.")["stats"]["readingLevel"]["grade"], 0.0);
    assert_eq!(analyze("123 456")["stats"]["readingLevel"]["grade"], Value::Null);
}

#[test]
fn word_frequency_stats_count_fragments_paragraphs_and_combining_marks() {
    let output = analyze("Don't stop\nhere\n \nCafe\u{301} waits!?!\n\nLast fragment");
    assert_eq!(output["stats"]["words"], 7);
    assert_eq!(output["stats"]["paragraphs"], 3);
    assert_eq!(output["stats"]["sentences"], 3);
    assert_eq!(output["totalWords"], 7);
    assert!(output["items"].as_array().unwrap().iter().any(|item| item["word"] == "cafe\u{301}"));
    assert_eq!(analyze("''' — !!!")["stats"]["words"], 0);
    assert_eq!(analyze("''' — !!!")["totalWords"], 0);
    let contractions = analyze("'Don't' don’t rock’n’roll");
    assert_eq!(contractions["totalWords"], 3);
    assert_eq!(contractions["stats"]["words"], 3);
    assert_eq!(analyze("One． Two！ Three？")["stats"]["sentences"], 3);
}

#[test]
fn word_frequency_stats_round_times_up_at_minute_boundaries() {
    let text = std::iter::repeat("word").take(201).collect::<Vec<_>>().join(" ");
    let stats = &analyze(&text)["stats"];
    assert_eq!(stats["readingTime"]["seconds"], 61);
    assert_eq!(stats["speakingTime"]["seconds"], 93);
}
