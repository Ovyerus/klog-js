export default {
  records: [
    {
      date: new Date(2018, 2, 24),
      entries: [
        {
          summary: null,
          type: "entry",
          value: {
            end: {
              format: "24h",
              hour: 17,
              minute: 0,
              shift: 0,
              type: "time",
            },
            format: 0,
            open: false,
            start: {
              format: "24h",
              hour: 8,
              minute: 30,
              shift: 0,
              type: "time",
            },
            type: "timeRange",
          },
        },
        {
          summary: "Lunch break",
          type: "entry",
          value: {
            sign: "-",
            type: "duration",
            value: -45,
          },
        },
      ],
      shouldTotal: null,
      summary: "First day at my new job",
      type: "record",
    },
    {
      date: new Date(2018, 2, 25),
      entries: [
        {
          summary: null,
          type: "entry",
          value: {
            sign: "",
            type: "duration",
            value: 495,
          },
        },
      ],
      shouldTotal: 510,
      summary: null,
      type: "record",
    },
    {
      date: new Date(2018, 2, 26),
      entries: [
        {
          summary: null,
          type: "entry",
          value: {
            end: {
              format: "24h",
              hour: 11,
              minute: 15,
              shift: 0,
              type: "time",
            },
            format: 0,
            open: false,
            start: {
              format: "24h",
              hour: 8,
              minute: 30,
              shift: 0,
              type: "time",
            },
            type: "timeRange",
          },
        },
        {
          summary: "Meeting with Sarah",
          type: "entry",
          value: {
            end: {
              format: "24h",
              hour: 12,
              minute: 20,
              shift: 0,
              type: "time",
            },
            format: 0,
            open: false,
            start: {
              format: "24h",
              hour: 11,
              minute: 15,
              shift: 0,
              type: "time",
            },
            type: "timeRange",
          },
        },
        {
          summary: null,
          type: "entry",
          value: {
            sign: "",
            type: "duration",
            value: 240,
          },
        },
      ],
      shouldTotal: null,
      summary:
        "More onboarding. Also started\nto work on my first small project!",
      type: "record",
    },
  ],
  type: "file",
};
