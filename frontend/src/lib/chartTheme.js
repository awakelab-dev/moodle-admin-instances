export const chartColors = {
  tick: '#C9D6EA',
  tooltipBg: '#01264C',
  grid: 'rgba(240, 243, 252, 0.10)',
  series: ['#19F7F1', '#0FCED3', '#0ABCC9', '#0B93AA', '#4E7EA5', '#72A3C4', '#3B6996', '#34547A', '#D9FBFF', '#11EAEA'],
};

export const chartFontFamily = "'Poppins', sans-serif";

export function getPlatformColor(index) {
  return chartColors.series[index % chartColors.series.length];
}

export function getMarginColor(value) {
  return value < 0 ? '#34547A' : '#19F7F1';
}

export function baseChartOptions(overrides = {}) {
  return {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 12,
      },
      ...overrides.plugins,
    },
    scales: {
      x: {
        ticks: { color: chartColors.tick, font: { size: 11, family: chartFontFamily } },
        grid: { color: chartColors.grid },
        border: { display: false },
        ...overrides.scales?.x,
      },
      y: {
        ticks: { color: chartColors.tick, font: { size: 11, family: chartFontFamily } },
        grid: { display: false },
        border: { display: false },
        ...overrides.scales?.y,
      },
    },
  };
}
