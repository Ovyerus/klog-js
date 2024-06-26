export default {
  records: [
    {
      date: new Date(2024, 3, 29),
      entries: [
        {
          summary: null,
          type: "entry",
          value: {
            end: {
              format: "24h",
              hour: 11,
              minute: 30,
              shift: 0,
              type: "time",
            },
            format: 0,
            open: false,
            start: {
              format: "24h",
              hour: 9,
              minute: 30,
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
            value: 45,
          },
        },
      ],
      shouldTotal: null,
      summary: null,
      type: "record",
    },
    {
      date: new Date(2024, 3, 29),
      entries: [
        {
          summary: null,
          type: "entry",
          value: {
            end: {
              format: "24h",
              hour: 17,
              minute: 30,
              shift: 0,
              type: "time",
            },
            format: 0,
            open: false,
            start: {
              format: "24h",
              hour: 13,
              minute: 0,
              shift: 0,
              type: "time",
            },
            type: "timeRange",
          },
        },
      ],
      shouldTotal: null,
      summary: null,
      type: "record",
    },
  ],
  type: "file",
};
