// src/config/festivalConfig.js
// Curated list of major Indian festivals with styling (Keka.com style)

class FestivalConfig {
  /**
   * Get curated list of major Indian festivals with styling
   * This list includes only the most important festivals to avoid notification fatigue
   */
  static getMajorFestivals(year = new Date().getFullYear()) {
    return [
      // ============================================
      // NATIONAL HOLIDAYS
      // ============================================
      {
        name: "Republic Day",
        date: { iso: `${year}-01-26` },
        type: ["National holiday"],
        description: "Republic Day of India",
        festivalType: "NATIONAL_HOLIDAY",
        priority: "MAJOR",
        backgroundColor: "#FF9933",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/republic-day.svg",
        greetingMessage: "🇮🇳 Happy Republic Day! Let's celebrate our Constitution and democracy!"
      },
      {
        name: "Independence Day", 
        date: { iso: `${year}-08-15` },
        type: ["National holiday"],
        description: "Independence Day of India",
        festivalType: "NATIONAL_HOLIDAY",
        priority: "MAJOR",
        backgroundColor: "#138808",
        textColor: "#FFFFFF", 
        vectorImage: "/icons/festivals/independence-day.svg",
        greetingMessage: "🇮🇳 Happy Independence Day! Celebrating 78 years of freedom and unity!"
      },
      {
        name: "Gandhi Jayanti",
        date: { iso: `${year}-10-02` },
        type: ["National holiday"],
        description: "Birth anniversary of Mahatma Gandhi",
        festivalType: "NATIONAL_HOLIDAY",
        priority: "MAJOR",
        backgroundColor: "#87CEEB",
        textColor: "#333333",
        vectorImage: "/icons/festivals/gandhi-jayanti.svg",
        greetingMessage: "🕊️ Happy Gandhi Jayanti! Remembering the Father of our Nation."
      },

      // ============================================
      // MAJOR HINDU FESTIVALS
      // ============================================
      {
        name: "Diwali",
        alternateNames: ["Deepavali", "Festival of Lights"],
        type: ["Hindu"],
        description: "Festival of Lights",
        festivalType: "HINDU",
        religion: "HINDUISM",
        priority: "MAJOR",
        backgroundColor: "#FF6B35",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/diwali.svg",
        greetingMessage: "🪔 Happy Diwali! May the festival of lights illuminate your life with joy and prosperity!",
        isLunar: true // Will be fetched from API
      },
      {
        name: "Holi",
        alternateNames: ["Festival of Colors"],
        type: ["Hindu"],
        description: "Festival of Colors",
        festivalType: "HINDU", 
        religion: "HINDUISM",
        priority: "MAJOR",
        backgroundColor: "#E91E63",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/holi.svg",
        greetingMessage: "🌈 Happy Holi! Let the colors of joy paint your life with happiness!",
        isLunar: true
      },
      {
        name: "Dussehra",
        alternateNames: ["Vijayadashami"],
        type: ["Hindu"],
        description: "Victory of good over evil",
        festivalType: "HINDU",
        religion: "HINDUISM", 
        priority: "MAJOR",
        backgroundColor: "#9C27B0",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/dussehra.svg",
        greetingMessage: "🏹 Happy Dussehra! May good triumph over evil in your life!",
        isLunar: true
      },
      {
        name: "Raksha Bandhan",
        type: ["Hindu"],
        description: "Bond between brothers and sisters",
        festivalType: "HINDU",
        religion: "HINDUISM",
        priority: "MAJOR", 
        backgroundColor: "#FF5722",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/raksha-bandhan.svg",
        greetingMessage: "👫 Happy Raksha Bandhan! Celebrating the beautiful bond of love and protection!",
        isLunar: true
      },
      {
        name: "Janmashtami",
        alternateNames: ["Krishna Janmashtami"],
        type: ["Hindu"],
        description: "Birth of Lord Krishna",
        festivalType: "HINDU",
        religion: "HINDUISM",
        priority: "MAJOR",
        backgroundColor: "#3F51B5",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/janmashtami.svg",
        greetingMessage: "🦚 Happy Janmashtami! May Lord Krishna bless you with joy and prosperity!",
        isLunar: true
      },

      // ============================================
      // MAJOR MUSLIM FESTIVALS
      // ============================================
      {
        name: "Eid al-Fitr",
        alternateNames: ["Eid"],
        type: ["Muslim"],
        description: "End of Ramadan",
        festivalType: "MUSLIM",
        religion: "ISLAM",
        priority: "MAJOR",
        backgroundColor: "#4CAF50",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/eid-fitr.svg",
        greetingMessage: "🌙 Eid Mubarak! May this blessed day bring peace and happiness to your life!",
        isLunar: true
      },
      {
        name: "Eid al-Adha",
        alternateNames: ["Bakrid", "Festival of Sacrifice"],
        type: ["Muslim"],
        description: "Festival of Sacrifice",
        festivalType: "MUSLIM",
        religion: "ISLAM",
        priority: "MAJOR",
        backgroundColor: "#2E7D32",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/eid-adha.svg",
        greetingMessage: "🐐 Eid al-Adha Mubarak! May your sacrifices bring you closer to divine blessings!",
        isLunar: true
      },

      // ============================================
      // MAJOR CHRISTIAN FESTIVALS  
      // ============================================
      {
        name: "Christmas",
        date: { iso: `${year}-12-25` },
        type: ["Christian"],
        description: "Birth of Jesus Christ",
        festivalType: "CHRISTIAN",
        religion: "CHRISTIANITY",
        priority: "MAJOR",
        backgroundColor: "#C62828",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/christmas.svg",
        greetingMessage: "🎄 Merry Christmas! May the spirit of Christmas fill your home with love and joy!"
      },
      {
        name: "Easter",
        type: ["Christian"],
        description: "Resurrection of Jesus Christ",
        festivalType: "CHRISTIAN",
        religion: "CHRISTIANITY",
        priority: "MAJOR",
        backgroundColor: "#FFB74D",
        textColor: "#333333",
        vectorImage: "/icons/festivals/easter.svg",
        greetingMessage: "🐣 Happy Easter! May this day bring new hope and blessings to your life!",
        isLunar: true // Date varies each year
      },

      // ============================================
      // MAJOR SIKH FESTIVALS
      // ============================================
      {
        name: "Guru Nanak Jayanti",
        alternateNames: ["Guru Nanak's Birthday"],
        type: ["Sikh"],
        description: "Birth anniversary of Guru Nanak",
        festivalType: "SIKH",
        religion: "SIKHISM",
        priority: "MAJOR",
        backgroundColor: "#FF9800",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/guru-nanak-jayanti.svg",
        greetingMessage: "🙏 Happy Guru Nanak Jayanti! May Guru Nanak's teachings guide your path!",
        isLunar: true
      },

      // ============================================
      // MAJOR BUDDHIST FESTIVALS
      // ============================================
      {
        name: "Buddha Purnima",
        alternateNames: ["Buddha Jayanti", "Vesak"],
        type: ["Buddhist"],
        description: "Birth, enlightenment and death of Buddha",
        festivalType: "BUDDHIST",
        religion: "BUDDHISM",
        priority: "MAJOR",
        backgroundColor: "#673AB7",
        textColor: "#FFFFFF",
        vectorImage: "/icons/festivals/buddha-purnima.svg",
        greetingMessage: "☸️ Happy Buddha Purnima! May Buddha's wisdom bring peace to your heart!",
        isLunar: true
      }
    ];
  }

  /**
   * Get static/fallback festivals in case external API fails
   */
  static getStaticFestivals(year = new Date().getFullYear()) {
    const staticFestivals = [
      {
        name: "Republic Day",
        date: { iso: `${year}-01-26` },
        type: ["National holiday"],
        description: "Republic Day of India"
      },
      {
        name: "Independence Day", 
        date: { iso: `${year}-08-15` },
        type: ["National holiday"],
        description: "Independence Day of India"
      },
      {
        name: "Gandhi Jayanti",
        date: { iso: `${year}-10-02` },
        type: ["National holiday"], 
        description: "Birth anniversary of Mahatma Gandhi"
      },
      {
        name: "Christmas",
        date: { iso: `${year}-12-25` },
        type: ["Christian"],
        description: "Birth of Jesus Christ"
      }
    ];
    
    return { holidays: staticFestivals };
  }

  /**
   * Get festival styling configuration
   */
  static getFestivalStyling() {
    return {
      defaultColors: {
        backgroundColor: "#f8f9fa",
        textColor: "#333333"
      },
      priorityColors: {
        MAJOR: {
          backgroundColor: "#FF6B35",
          textColor: "#FFFFFF"
        },
        REGIONAL: {
          backgroundColor: "#FFC107", 
          textColor: "#333333"
        },
        MINOR: {
          backgroundColor: "#E0E0E0",
          textColor: "#666666"
        }
      },
      religionColors: {
        HINDUISM: {
          backgroundColor: "#FF9800",
          textColor: "#FFFFFF"
        },
        ISLAM: {
          backgroundColor: "#4CAF50", 
          textColor: "#FFFFFF"
        },
        CHRISTIANITY: {
          backgroundColor: "#C62828",
          textColor: "#FFFFFF"
        },
        SIKHISM: {
          backgroundColor: "#FF5722",
          textColor: "#FFFFFF"
        },
        BUDDHISM: {
          backgroundColor: "#673AB7",
          textColor: "#FFFFFF"
        }
      }
    };
  }

  /**
   * External API configuration
   */
  static getAPIConfig() {
    return {
      calendarific: {
        baseUrl: "https://calendarific.com/api/v2",
        country: "IN", // India
        monthlyLimit: 1000,
        weeklyCallsNeeded: 2, // Current year + next year
        annualEstimate: 104 // 2 calls × 52 weeks
      }
    };
  }
}

module.exports = FestivalConfig;