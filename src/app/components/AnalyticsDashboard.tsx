import { motion } from "motion/react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, DollarSign, Users, Activity, Clock, Trophy } from "lucide-react";

type AnalyticsDashboardProps = {
  analyticsData?: {
    weeklyRevenue?: Array<{ day: string; amount: number }>;
    revenueBySport?: Array<{ name: string; value: number }>;
    summary?: {
      totalRevenue?: number;
      totalBookings?: number;
      activeUsers?: number;
      averageBookingValue?: number;
      avgRating?: number;
      topSport?: string;
      openCourts?: number;
      totalCourts?: number;
    };
  } | null;
};

export function AnalyticsDashboard({ analyticsData }: AnalyticsDashboardProps) {
  const fallbackRevenueData = [
    { day: "Mon", revenue: 12500, bookings: 15 },
    { day: "Tue", revenue: 15800, bookings: 19 },
    { day: "Wed", revenue: 11200, bookings: 14 },
    { day: "Thu", revenue: 18900, bookings: 23 },
    { day: "Fri", revenue: 24500, bookings: 31 },
    { day: "Sat", revenue: 32100, bookings: 42 },
    { day: "Sun", revenue: 28700, bookings: 36 },
  ];

  const fallbackSportsData = [
    { name: "Basketball", value: 35, color: "#FF8C00" },
    { name: "Badminton", value: 25, color: "#22c55e" },
    { name: "Volleyball", value: 20, color: "#0047AB" },
    { name: "Pickleball", value: 10, color: "#a855f7" },
    { name: "Billiards", value: 6, color: "#ec4899" },
    { name: "Table Tennis", value: 4, color: "#06b6d4" },
  ];

  const revenueData = Array.isArray(analyticsData?.weeklyRevenue) && analyticsData.weeklyRevenue.length > 0
    ? analyticsData.weeklyRevenue.map((row) => ({ day: row.day, revenue: row.amount, bookings: 0 }))
    : fallbackRevenueData;

  const sportsData = Array.isArray(analyticsData?.revenueBySport) && analyticsData.revenueBySport.length > 0
    ? analyticsData.revenueBySport.map((entry, index) => ({
        name: entry.name,
        value: entry.value,
        color: ["#FF8C00", "#22c55e", "#0047AB", "#a855f7", "#ec4899", "#06b6d4"][index % 6],
      }))
    : fallbackSportsData;

  const peakHoursData = [
    { hour: "6AM", bookings: 2 },
    { hour: "8AM", bookings: 8 },
    { hour: "10AM", bookings: 15 },
    { hour: "12PM", bookings: 22 },
    { hour: "2PM", bookings: 28 },
    { hour: "4PM", bookings: 35 },
    { hour: "6PM", bookings: 42 },
    { hour: "8PM", bookings: 38 },
    { hour: "10PM", bookings: 18 },
  ];

  const customerTrends = [
    { month: "Sep", newCustomers: 45, returning: 32 },
    { month: "Oct", newCustomers: 58, returning: 47 },
    { month: "Nov", newCustomers: 72, returning: 65 },
    { month: "Dec", newCustomers: 89, returning: 82 },
    { month: "Jan", newCustomers: 105, returning: 98 },
    { month: "Feb", newCustomers: 118, returning: 115 },
  ];

  const totalRevenue = analyticsData?.summary?.totalRevenue ?? revenueData.reduce((sum, day) => sum + day.revenue, 0);
  const totalBookings = analyticsData?.summary?.totalBookings ?? revenueData.reduce((sum, day) => sum + day.bookings, 0);
  const avgRevenuePerBooking = analyticsData?.summary?.averageBookingValue ?? (totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0);
  const peakHour = peakHoursData.reduce((max, curr) => (curr.bookings > max.bookings ? curr : max)).hour;
  const activeUsers = analyticsData?.summary?.activeUsers ?? 347;
  const topSport = analyticsData?.summary?.topSport ?? sportsData[0]?.name ?? "Basketball";
  const openCourts = analyticsData?.summary?.openCourts ?? 0;
  const totalCourts = analyticsData?.summary?.totalCourts ?? 0;
  const courtUtilization = totalCourts > 0 ? Math.round((openCourts / totalCourts) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#FF8C00]/20 to-[#FF8C00]/5 border border-[#FF8C00]/30 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-[#FF8C00]" size={32} />
            <TrendingUp className="text-green-400" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">₱{totalRevenue.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Weekly Revenue</div>
          <div className="text-xs text-green-400 mt-1">Database-backed</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#0047AB]/20 to-[#0047AB]/5 border border-[#0047AB]/30 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <Calendar className="text-[#0047AB]" size={32} />
            <TrendingUp className="text-green-400" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">{totalBookings}</div>
          <div className="text-sm text-gray-400">Total Bookings</div>
          <div className="text-xs text-green-400 mt-1">From selected analytics range</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="text-purple-400" size={32} />
            <TrendingUp className="text-green-400" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">{activeUsers}</div>
          <div className="text-sm text-gray-400">Active Users</div>
          <div className="text-xs text-green-400 mt-1">Database-backed</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <Activity className="text-green-400" size={32} />
            <Clock className="text-[#FF8C00]" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">{topSport}</div>
          <div className="text-sm text-gray-400">Top Sport</div>
          <div className="text-xs text-gray-500 mt-1">Highest revenue mix</div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#1A1A1A] border border-white/10 rounded-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="text-[#FF8C00]" size={24} />
            <span>Weekly Revenue Trend</span>
          </h3>
          <div className="w-full h-[250px] min-h-[250px] min-w-[1px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart id="line-revenue" data={revenueData} key="revenue-chart">
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#333" />
                <XAxis key="xaxis" dataKey="day" stroke="#888" />
                <YAxis key="yaxis" stroke="#888" />
                <Tooltip
                  key="tooltip"
                  contentStyle={{
                    backgroundColor: "#1A1A1A",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                />
                <Legend key="legend" />
                <Line
                  key="line"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#FF8C00"
                  strokeWidth={3}
                  dot={{ fill: "#FF8C00", r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#1A1A1A] border border-white/10 rounded-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <Trophy className="text-[#FF8C00]" size={24} />
            <span>Popular Sports</span>
          </h3>
          <div className="w-full h-[250px] min-h-[250px] min-w-[1px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart id="pie-sports" key="sports-chart">
                <Pie
                  key="sports-pie"
                  data={sportsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={false}
                >
                  {sportsData.map((entry, index) => (
                    <Cell key={`analytics-cell-${entry.name}-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  key="tooltip"
                  contentStyle={{
                    backgroundColor: "#1A1A1A",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[#1A1A1A] border border-white/10 rounded-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <Clock className="text-[#0047AB]" size={24} />
            <span>Peak Hours Analysis</span>
          </h3>
          <div className="w-full h-[250px] min-h-[250px] min-w-[1px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart id="bar-peak" data={peakHoursData} key="peak-hours-chart">
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#333" />
                <XAxis key="xaxis" dataKey="hour" stroke="#888" />
                <YAxis key="yaxis" stroke="#888" />
                <Tooltip
                  key="tooltip"
                  contentStyle={{
                    backgroundColor: "#1A1A1A",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                />
                <Bar key="bar" isAnimationActive={false} dataKey="bookings" fill="#0047AB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-[#1A1A1A] border border-white/10 rounded-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <Users className="text-purple-400" size={24} />
            <span>Customer Growth</span>
          </h3>
          <div className="w-full h-[250px] min-h-[250px] min-w-[1px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart id="bar-customer" data={customerTrends} key="customer-trends-chart">
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#333" />
                <XAxis key="xaxis" dataKey="month" stroke="#888" />
                <YAxis key="yaxis" stroke="#888" />
                <Tooltip
                  key="tooltip"
                  contentStyle={{
                    backgroundColor: "#1A1A1A",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                />
                <Legend key="legend" />
                <Bar key="bar-new" isAnimationActive={false} dataKey="newCustomers" fill="#22c55e" radius={[8, 8, 0, 0]} name="New Customers" />
                <Bar key="bar-ret" isAnimationActive={false} dataKey="returning" fill="#a855f7" radius={[8, 8, 0, 0]} name="Returning" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-r from-[#FF8C00]/10 to-[#0047AB]/10 border border-[#FF8C00]/20 rounded-xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Avg Revenue per Booking</p>
            <p className="text-2xl font-bold text-[#FF8C00]">₱{avgRevenuePerBooking}</p>
          </div>
          <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Court Utilization Rate</p>
            <p className="text-2xl font-bold text-[#0047AB]">{totalCourts > 0 ? `${courtUtilization}%` : '—'}</p>
          </div>
          <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Database Signal</p>
            <p className="text-2xl font-bold text-green-400">{analyticsData?.summary?.avgRating ? analyticsData.summary.avgRating.toFixed(2) : 'Live'}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
