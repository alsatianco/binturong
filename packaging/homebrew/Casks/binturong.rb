cask "binturong" do
  version "0.1.0"
  sha256 "REPLACE_WITH_DMG_SHA256"

  url "https://github.com/alsatianco/binturong/releases/download/v#{version}/Binturong_#{version}_universal.dmg"
  name "Binturong"
  desc "Offline-first desktop developer utility suite"
  homepage "https://play.alsatian.co/software/binturong.html"

  app "Binturong.app"

  zap trash: [
    "~/Library/Application Support/Binturong",
    "~/Library/Preferences/com.binturong.app.plist",
    "~/Library/Saved Application State/com.binturong.app.savedState",
  ]
end
